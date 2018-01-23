class LoggedController < ApplicationController
  before_action :check_user

  def index; end

  private

  def check_user
    redirect_to root_path unless current_user
  end
end
