Rails.application.routes.draw do
  devise_for :admins, skip: :all
  devise_for :boys
  devise_for :girls
  as :admin do
    get 'login_admin', to: 'devise/sessions#new', as: :new_admin_session
    post 'login_admin', to: 'devise/sessions#create', as: :admin_session
    delete 'logout_admin', to: 'devise/sessions#destroy', as: :destroy_admin_session
  end
  get 'welcome/index'
  get 'rules' => 'welcome#rules'
  get 'main' => 'logged#index'
  get 'main_boy' => 'main_boy#index'
  get 'main_girl' => 'main_girl#index'
  get 'main_admin' => 'main_admin#index'
  get 'cv_serch' => 'admin_search#cv_search', as: :cv_search
  get 'usr_search' => 'user_search#usr_search', as: :usr_search
  # post 'report' => 'complaints#new', as: :report
  resource :complaint, only: :create, as: :report
  get 'users/:id' => 'users#show', as: :users
  get 'conversation' => 'conversation#index'
  get 'conversations/:id' => 'conversations#show'
  post '/conversation/leave' => 'conversation#leave', as: :leave_cv
  resources :messages
  root 'welcome#index'
end
