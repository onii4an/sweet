class WelcomeController < ApplicationController
  before_action :check_user

  def index; end

  private

  def check_user
    redirect_to main_path if current_user
  end
end
