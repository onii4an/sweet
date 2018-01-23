Rails.application.routes.draw do
  devise_for :users
  get 'welcome/index'
  get 'main' => 'logged#index'
  root 'welcome#index'
end
